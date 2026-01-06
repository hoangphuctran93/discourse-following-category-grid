import Component from "@glimmer/component";
import { action } from "@ember/object";
import { inject as service } from "@ember/service";
import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";
import DiscourseURL from "discourse/lib/url";
import { tracked } from '@glimmer/tracking';

export default class FollowingGrid extends Component {
  @service router;
  @service discovery;

  @tracked selectionVersion = 0;

  constructor() {
    super(...arguments);
    console.error("FollowingGrid: DEBUG INIT", {
      discoveryService: !!this.discovery,
      bulkSelectEnabled: this.discovery?.bulkSelectEnabled,
      topicsCount: (this.args.topics || []).length
    });
  }

  get bulkSelectEnabled() {
    return this.discovery.bulkSelectEnabled;
  }

  get showCheckboxes() {
    return this.bulkSelectEnabled;
  }

  get gridItems() {
    // Consume selectionVersion to force re-calculation when selection changes
    // This ensures checkboxes update correctly if external state changes or we toggle
    this.selectionVersion;

    const topics = this.args.topics || [];
    const settings = this.args.settings || {};

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
        tags: (topic.tags || []).map(t => ({ name: t, url: `/tag/${t}` })),
        voteCount: topic.vote_count || 0,
        userVoted: topic.user_voted || false,
        url: `/t/${topic.slug}/${topic.id}`,
        topic: topic,
        gradientStyle: gradients[index % gradients.length],
        voteBtnText: settings.vote_button_text || "Theo dõi",
        votedBtnText: settings.voted_button_text || "Đang theo dõi",
        isSelected: topic.selected,
        showCheckbox: this.bulkSelectEnabled
      };
    });
  }

  get selectedTopics() {
    this.selectionVersion; // Depend on version
    const topics = this.args.topics || [];
    const selected = topics.filter(t => t.selected);

    console.error("FollowingGrid: DEBUG selectedTopics", {
      count: selected.length,
      total: topics.length
    });

    return selected;
  }

  get hasSelection() {
    const has = this.selectedTopics.length > 0;
    console.error("FollowingGrid: DEBUG hasSelection", has);
    return has;
  }

  get selectedCount() {
    return this.selectedTopics.length;
  }

  @action
  toggleSelection(topic, event) {
    if (event) {
      event.stopImmediatePropagation();
    }

    console.error("FollowingGrid: DEBUG toggleSelection called", topic.id);

    if (topic.toggleProperty) {
      topic.toggleProperty("selected");
    } else {
      const newVal = !topic.selected;
      try {
        topic.set("selected", newVal);
      } catch (e) {
        topic.selected = newVal;
      }
    }
    console.error("FollowingGrid: DEBUG topic.selected is now", topic.selected);
    this.selectionVersion++;
  }

  @action
  selectAll() {
    (this.args.topics || []).forEach(t => {
      if (t.set) t.set("selected", true);
      else t.selected = true;
    });
    this.selectionVersion++;
  }

  @action
  clearAll() {
    (this.args.topics || []).forEach(t => {
      if (t.set) t.set("selected", false);
      else t.selected = false;
    });
    this.selectionVersion++;
  }

  @action
  visit(item) {
    if (this.bulkSelectEnabled) {
      return;
    }
    if (item.url) {
      DiscourseURL.routeTo(item.url);
    }
  }

  // --- Bulk Actions ---

  @action
  async bulkFollow() {
    await this._performVotingBatch(true);
  }

  @action
  async bulkUnfollow() {
    await this._performVotingBatch(false);
  }

  async _performVotingBatch(isFollow) {
    const selected = this.selectedTopics;
    if (selected.length === 0) return;
    const endpoint = isFollow ? "/voting/vote" : "/voting/unvote";

    for (const topic of selected) {
      if (isFollow && topic.user_voted) continue;
      if (!isFollow && !topic.user_voted) continue;

      try {
        await ajax(endpoint, { type: "POST", data: { topic_id: topic.id } });
        if (topic.set) {
          topic.set("user_voted", isFollow);
          const current = topic.get("vote_count") || 0;
          topic.set("vote_count", isFollow ? current + 1 : Math.max(0, current - 1));
        }
      } catch (e) {
        popupAjaxError(e);
      }
    }
    this.clearAll();
  }

  @action
  async bulkArchive() {
    await this._performBulkOperation("archive");
  }

  @action
  async bulkClose() {
    await this._performBulkOperation("close");
  }

  @action
  async bulkDelete() {
    if (!window.confirm(`Are you sure you want to delete ${this.selectedCount} topics?`)) return;
    await this._performBulkOperation("delete");
  }

  @action
  async bulkUnlist() {
    // 'unlist' operation is standard in Discourse bulk actions
    await this._performBulkOperation("unlist");
  }

  async _performBulkOperation(operationType) {
    const selected = this.selectedTopics;
    if (selected.length === 0) return;

    const topicIds = selected.map(t => t.id);

    try {
      await ajax("/topics/bulk", {
        type: "PUT",
        data: {
          topic_ids: topicIds,
          operation: { type: operationType }
        }
      });

      // Optimistic UI updates
      selected.forEach(topic => {
        if (topic.set) {
          if (operationType === 'close') topic.set('closed', true);
          if (operationType === 'archive') topic.set('archived', true);
          if (operationType === 'unlist') topic.set('visible', false);
          // For delete, we might want to reload or hide the item
        }
      });

      if (operationType === 'delete') {
        window.location.reload();
      }

    } catch (e) {
      popupAjaxError(e);
    }

    this.clearAll();
  }

  // --- Drag to Scroll Handler ---
  isDown = false;
  startX = 0;
  scrollLeft = 0;
  isDragging = false;

  @action
  onTagsMouseDown(event) {
    const slider = event.currentTarget;
    this.isDown = true;
    this.isDragging = false;
    this.startX = event.pageX - slider.offsetLeft;
    this.scrollLeft = slider.scrollLeft;
  }

  @action
  onTagsMouseLeave() {
    this.isDown = false;
  }

  @action
  onTagsMouseUp() {
    this.isDown = false;
  }

  @action
  onTagsMouseMove(event) {
    if (!this.isDown) return;
    event.preventDefault();
    const slider = event.currentTarget;
    const x = event.pageX - slider.offsetLeft;
    const walk = (x - this.startX) * 2;
    if (Math.abs(x - this.startX) > 5) {
      this.isDragging = true;
    }
    slider.scrollLeft = this.scrollLeft - walk;
  }

  @action
  onTagsClick(event) {
    if (this.isDragging) {
      event.stopImmediatePropagation();
      event.preventDefault();
      this.isDragging = false;
      return;
    }
    const tagElement = event.target.closest('.card-tag');
    if (tagElement && tagElement.dataset.url) {
      event.stopImmediatePropagation();
      event.preventDefault();
      DiscourseURL.routeTo(tagElement.dataset.url);
      return;
    }
  }

  @action
  async toggleVote(item, event) {
    if (event) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
    const topic = item.topic;
    if (!topic) return;

    const isFollow = !topic.user_voted;
    const endpoint = isFollow ? "/voting/vote" : "/voting/unvote";

    try {
      await ajax(endpoint, { type: "POST", data: { topic_id: topic.id } });
      topic.set("user_voted", isFollow);
      const current = topic.get("vote_count") || 0;
      topic.set("vote_count", isFollow ? current + 1 : Math.max(0, current - 1));
    } catch (e) {
      popupAjaxError(e);
    }
  }
}
