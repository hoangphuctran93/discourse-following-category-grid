import Component from "@glimmer/component";
import { inject as service } from "@ember/service";
import { getOwner } from "@ember/application";

export default class FollowingConnector extends Component {
    @service router;

    get shouldRender() {
        const category = this.args.outletArgs?.category;

        // Check by ID (7) or Slug ('following')
        if (category && (category.id === 7 || category.slug === "following")) {
            // HACK: Add class to body to trigger CSS hiding helper
            if (document && document.body) {
                document.body.classList.add("custom-following-page");
            }
            return true;
        }

        // Cleanup if we leave the page (though logic might need an explicit cleanup)
        if (document && document.body) {
            document.body.classList.remove("custom-following-page");
        }
        return false;
    }

    get topics() {
        // 1. Try args
        if (this.args.outletArgs?.topics) {
            return this.args.outletArgs.topics;
        }

        // 2. Try controller lookup (Robust fallback for 2025 structure)
        try {
            const controller = getOwner(this).lookup("controller:discovery/topics");
            if (controller && controller.model && controller.model.topics) {
                return controller.model.topics;
            }
        } catch (e) {
            console.warn("Could not lookup discovery controller", e);
        }

        return [];
    }
}
