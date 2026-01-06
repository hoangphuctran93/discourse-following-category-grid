import Component from "@glimmer/component";
import { action } from "@ember/object";
import { tracked } from "@glimmer/tracking";
import { inject as service } from "@ember/service";
import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";
import DiscourseURL from "discourse/lib/url";

export default class FollowingGrid extends Component {
  @service router;

  // Bulk Select State
  @tracked bulkSelectMode = false;
  @tracked selectedIds = new Set();

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
        tags: (topic.tags || []).map(t => ({ name: t, url: `/tag/${t}` })),
        voteCount: topic.vote_count || 0, // Using vote_count from topic voting plugin
        userVoted: topic.user_voted || false,
        url: `/t/${topic.slug}/${topic.id}`, // specific url property
        topic: topic, // pass native object for actions
        gradientStyle: gradients[index % gradients.length],
        voteBtnText: settings.vote_button_text || "Theo dõi",
        votedBtnText: settings.voted_button_text || "Đang theo dõi",
        isSelected: this.selectedIds.has(topic.id), // Selection state
        showCheckbox: this.bulkSelectMode // Show checkbox only in bulk mode
      };
    });
  }

  // Computed properties for bulk select
  get hasSelection() {
    return this.selectedIds.size > 0;
  }

  get selectedCount() {
    return this.selectedIds.size;
  }

  get allSelected() {
    const topics = this.args.topics || [];
    return topics.length > 0 && this.selectedIds.size === topics.length;
  }

  get bulkSelectEnabled() {
    return this.args.bulkSelectEnabled !== false; // Default to true
  }

  // Bulk Select Actions
  @action
  toggleBulkSelectMode() {
    this.bulkSelectMode = !this.bulkSelectMode;
    if (!this.bulkSelectMode) {
      // Clear selections when exiting bulk mode
      this.selectedIds.clear();
      this.selectedIds = new Set(); // Trigger reactivity
    }
  }

  @action
  toggleItemSelection(itemId, event) {
    if (event) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }

    if (this.selectedIds.has(itemId)) {
      this.selectedIds.delete(itemId);
    } else {
      this.selectedIds.add(itemId);
    }
    // Trigger reactivity by creating new Set
    this.selectedIds = new Set(this.selectedIds);
  }

  @action
  selectAll() {
    const topics = this.args.topics || [];
    topics.forEach(topic => {
      this.selectedIds.add(topic.id);
    });
    this.selectedIds = new Set(this.selectedIds);
  }

  @action
  clearAll() {
    this.selectedIds.clear();
    this.selectedIds = new Set();
    this.bulkSelectMode = false;
  }

  @action
  clearSelection() {
    this.selectedIds.clear();
    this.selectedIds = new Set();
  }

  @action
  visit(item) {
    // Prevent navigation when in bulk select mode
    if (this.bulkSelectMode) {
      return;
    }
    if (item.url) {
      DiscourseURL.routeTo(item.url);
    }
  }

  // Bulk Actions
  @action
  async bulkFollow() {
    const selectedTopics = this.gridItems.filter(item => this.selectedIds.has(item.id));

    for (const item of selectedTopics) {
      if (!item.topic.user_voted) {
        try {
          await ajax("/voting/vote", {
            type: "POST",
            data: { topic_id: item.id }
          });
          item.topic.set("user_voted", true);
          item.topic.set("vote_count", (item.topic.vote_count || 0) + 1);
        } catch (e) {
          popupAjaxError(e);
        }
      }
    }

    // Clear selection after bulk action
    this.clearSelection();
  }

  @action
  async bulkUnfollow() {
    const selectedTopics = this.gridItems.filter(item => this.selectedIds.has(item.id));

    for (const item of selectedTopics) {
      if (item.topic.user_voted) {
        try {
          await ajax("/voting/unvote", {
            type: "POST",
            data: { topic_id: item.id }
          });
          item.topic.set("user_voted", false);
          item.topic.set("vote_count", Math.max(0, (item.topic.vote_count || 0) - 1));
        } catch (e) {
          popupAjaxError(e);
        }
      }
    }

    // Clear selection after bulk action
    this.clearSelection();
  }

  // Drag to Scroll State
  isDown = false;
  startX = 0;
  scrollLeft = 0;
  isDragging = false;

  @action
  toggleSelect(event) {
    if (event) {
      event.stopImmediatePropagation();
    }
  }

  // --- Drag to Scroll Handlers ---

  @action
  onTagsMouseDown(event) {
    const slider = event.currentTarget;
    this.isDown = true;
    this.isDragging = false; // Reset drag status
    this.startX = event.pageX - slider.offsetLeft;
    this.scrollLeft = slider.scrollLeft;

    // Optional: Add 'active' class for cursor grabbing styling if needed
    // slider.classList.add('active');
  }

  @action
  onTagsMouseLeave() {
    this.isDown = false;
  }

  @action
  onTagsMouseUp() {
    this.isDown = false;
    // Delay resetting isDragging slightly to allow the 'click' event to fire and check it
    // But usually click fires immediately after mouseup.
    // We let onTagsClick handle the check.
  }

  @action
  onTagsMouseMove(event) {
    if (!this.isDown) return;

    event.preventDefault(); // Stop text selection
    const slider = event.currentTarget;
    const x = event.pageX - slider.offsetLeft;
    const walk = (x - this.startX) * 2; // Scroll-fast multiplier

    // Threshold to consider it a drag
    if (Math.abs(x - this.startX) > 5) {
      this.isDragging = true;
    }

    slider.scrollLeft = this.scrollLeft - walk;
  }

  @action
  onTagsClick(event) {
    // 1. If dragging, STOP everything (no navigation, no bubbling)
    if (this.isDragging) {
      event.stopImmediatePropagation();
      event.preventDefault();
      this.isDragging = false;
      return;
    }

    // 2. If NOT dragging, check if user clicked a specific tag
    const tagElement = event.target.closest('.card-tag');
    if (tagElement && tagElement.dataset.url) {
      event.stopImmediatePropagation(); // Don't allow bubble to Topic
      event.preventDefault();
      DiscourseURL.routeTo(tagElement.dataset.url); // Navigate to Tag
      return;
    }

    // 3. If clicked on empty space in tags list, Let it bubble -> Card Navigation (Topic) logic takes over
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
