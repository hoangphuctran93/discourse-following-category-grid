import Component from "@glimmer/component";
import { action } from "@ember/object";
import { inject as service } from "@ember/service";
import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";
import DiscourseURL from "discourse/lib/url";

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
        displayName: topic.title,
        displayDescription: topic.excerpt || "",
        categoryName: topic.category ? topic.category.name : "General",
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
    if (item.url) {
      DiscourseURL.routeTo(item.url);
    }
  }

  @action
  async toggleVote(item, event) {
    if (event) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }

    const direction = item.userVoted ? "remove" : "up";

    const topic = item.topic;
    if (topic) {
      const oldVoteCount = topic.get("vote_count") || 0;
      const newVoteCount = direction === "up" ? oldVoteCount + 1 : Math.max(0, oldVoteCount - 1);

      topic.set("user_voted", direction === "up");
      topic.set("vote_count", newVoteCount);
    }

    try {
      if (direction === "up") {
        await ajax("/voting/vote", {
          type: "POST",
          data: { topic_id: item.id }, // Usually doesn't need type if just upvoting
        });
      } else {
        // Unvote Logic
        await ajax("/voting/unvote", {
          type: "POST",
          data: { topic_id: item.id }
        });
      }
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
