import Component from "@glimmer/component";
import { action } from "@ember/object";
import { inject as service } from "@ember/service";
import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";
import DiscourseURL from "discourse/lib/url";
import { getOwner } from "@ember/application";
import { tracked } from '@glimmer/tracking';

export default class FollowingGrid extends Component {
  @service router;
  @service discovery;

  @tracked isBulkSelectEnabled = false;
  _pollInterval = null;

  constructor() {
    super(...arguments);
    this.startStatePolling();
  }

  willDestroy() {
    super.willDestroy(...arguments);
    if (this._pollInterval) {
      clearInterval(this._pollInterval);
    }
  }

  startStatePolling() {
    // Check every 500ms for the native bulk select class
    // This is a robust fallback since direct controller access is flaky in themes
    this._pollInterval = setInterval(() => {
      const isEnabled = !!document.querySelector(".topic-list.bulk-select-enabled, body.bulk-select-enabled");
      if (this.isBulkSelectEnabled !== isEnabled) {
        this.isBulkSelectEnabled = isEnabled;
      }
    }, 500);
  }

  get showCheckboxes() {
    return this.isBulkSelectEnabled;
  }

  get gridItems() {
    const topics = this.args.topics || [];
    const settings = this.args.settings || {}; // Ensure settings is available

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
        tags: (topic.tags || []).map(t => ({ name: t, url: `/tag/${t}` })),
        voteCount: topic.vote_count || 0,
        userVoted: topic.user_voted || false,
        url: `/t/${topic.slug}/${topic.id}`,
        topic: topic,
        gradientStyle: gradients[index % gradients.length],
        voteBtnText: settings.vote_button_text || "Theo dõi",
        votedBtnText: settings.voted_button_text || "Đang theo dõi",
        isSelected: topic.selected, // Use native selected property
        showCheckbox: this.isBulkSelectEnabled // Show checkbox whenever native bulk mode is on
      };
    });
  }

  get selectedTopics() {
    return (this.args.topics || []).filter(t => t.selected);
  }

  get hasSelection() {
    return this.selectedTopics.length > 0;
  }

  get selectedCount() {
    return this.selectedTopics.length;
  }

  @action
  toggleSelection(topic, event) {
    if (event) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
    // Toggle native property
    if (topic.toggleProperty) {
      topic.toggleProperty("selected");
    } else {
      // Fallback if not an Ember object (unlikely in Discourse)
      // We use Ember.set if imported, or just direct assignment if POJO (but POJO won't track)
      // Usually topics are objects.
      const newVal = !topic.selected;
      try {
        topic.set("selected", newVal);
      } catch (e) {
        topic.selected = newVal;
      }
    }
    // Force re-computation if needed, but Glimmer tracks 'topic.selected' if it's a tracked property on the model
  }

  @action
  selectAll() {
    (this.args.topics || []).forEach(t => {
      if (t.set) t.set("selected", true);
      else t.selected = true;
    });
  }

  @action
  clearAll() {
    (this.args.topics || []).forEach(t => {
      if (t.set) t.set("selected", false);
      else t.selected = false;
    });
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
      // Skip if already in desired state
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
    await this._performStatusUpdate("archived", true);
  }

  @action
  async bulkClose() {
    await this._performStatusUpdate("closed", true);
  }

  @action
  async bulkDelete() {
    // Delete often requires a DELETE call per topic usually
    // Endpoint: DELETE /t/:id
    const selected = this.selectedTopics;
    if (selected.length === 0) return;

    if (!window.confirm(`Are you sure you want to delete ${selected.length} topics?`)) return;

    for (const topic of selected) {
      try {
        await ajax(`/t/${topic.id}`, { type: "DELETE" });
        // Remove from list? Or just reload?
      } catch (e) {
        popupAjaxError(e);
      }
    }
    // Refresh or reload
    window.location.reload();
  }

  @action
  async bulkUnlist() {
    await this._performStatusUpdate("visible", false);
  }

  // Generic status update (closed, archived, visible, pinned)
  async _performStatusUpdate(status, enabled) {
    const selected = this.selectedTopics;
    if (selected.length === 0) return;

    for (const topic of selected) {
      try {
        // PUT /t/:id/status
        // params: status (closed, archived, etc), enabled (true/false)
        await ajax(`/t/${topic.id}/status`, {
          type: "PUT",
          data: { status: status, enabled: enabled }
        });

        if (topic.set) {
          topic.set(status, enabled);
        }
      } catch (e) {
        popupAjaxError(e);
      }
    }
    this.clearAll();
  }

  // --- Drag to Scroll Handler (Unchanged) ---
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
