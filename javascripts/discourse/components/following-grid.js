import Component from "@glimmer/component";
import { action } from "@ember/object";
import { inject as service } from "@ember/service";
import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";

export default class FollowingGrid extends Component {
  @service router;

  get gridItems() {
    const topics = this.args.topics || [];

    const gradients = [
      "linear-gradient(to right, #3b82f6, #6366f1)", // blue to indigo
      "linear-gradient(to right, #a855f7, #ec4899)", // purple to pink
      "linear-gradient(to right, #f97316, #ef4444)", // orange to red
      "linear-gradient(to right, #14b8a6, #22c55e)"  // teal to green
    ];

    return topics.map((topic, index) => {
      const posters = topic.posters || [];
      const opPoster = posters.find((p) => p.description.includes("Original Poster")) || posters[0];
      const user = opPoster && opPoster.user ? opPoster.user : null;

      // Thumbnail Logic: Topic Image -> Topic Thumbnail -> Avatar
      let thumbnailUrl = "";
      if (topic.image_url) {
        thumbnailUrl = topic.image_url;
      } else if (topic.thumbnails && topic.thumbnails.length > 0) {
        thumbnailUrl = topic.thumbnails[0].url;
      } else if (user && user.avatar_template) {
        thumbnailUrl = user.avatar_template.replace("{size}", "200");
      }

      if (thumbnailUrl && !thumbnailUrl.startsWith("http")) {
        thumbnailUrl = window.location.origin + thumbnailUrl;
      }

      return {
        id: topic.id,
        title: topic.title,
        categoryName: topic.category ? topic.category.name : "General",
        username: user ? user.username : "Unknown",
        name: user ? user.name : topic.last_poster_username,
        thumbnailUrl: thumbnailUrl,
        voteCount: topic.vote_count || 0, // Using vote_count from topic voting plugin
        userVoted: topic.user_voted || false,
        url: `/t/${topic.slug}/${topic.id}`, // specific url property
        topic: topic, // pass native object for actions
        gradientStyle: gradients[index % gradients.length]
      };
    });
  }

  @action
  visit(item) {
    if (item.id) {
      this.router.transitionTo("topic.show", item.id);
    } else {
      window.location.href = item.url;
    }
  }

  @action
  async toggleVote(item, event) {
    if (event) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }

    const direction = item.userVoted ? "remove" : "up";

    // Optimistic UI Update using Ember.set on the underlying topic model
    // This allows the change to reflect immediately if the template is observing the topic model, 
    // or if we trigger a re-render. Since 'item' is a POJO created in getter, 
    // we must manually update the item status OR force re-computation.
    // However, Glimmer tracked properties are best.
    // We will update the 'topic' Ember Object which is efficient.

    const topic = item.topic;
    if (topic) {
      const oldVoteCount = topic.get("vote_count") || 0;
      const newVoteCount = direction === "up" ? oldVoteCount + 1 : Math.max(0, oldVoteCount - 1);

      topic.set("user_voted", direction === "up");
      topic.set("vote_count", newVoteCount);
    }

    try {
      await ajax("/topic_votings/vote", {
        type: "POST",
        data: { topic_id: item.id, type: direction },
      });
    } catch (e) {
      popupAjaxError(e);
      // Revert if failed
      if (topic) {
        topic.set("user_voted", direction !== "up");
        // Revert count logic... simplified
      }
    }
  }
}
