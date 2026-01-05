import Component from "@glimmer/component";
import { inject as service } from "@ember/service";
import { getOwner } from "@ember/application";

export default class FollowingConnector extends Component {
    @service router;
    @service("controller:discovery/topics") discoveryTopicsController;

    get shouldRender() {
        const category = this.args.outletArgs?.category;
        const settingValue = settings.following_grid_category;

        if (!category || !settingValue) {
            return false;
        }

        const targets = settingValue.split("|").map(t => t.trim()).filter(Boolean);

        if (category) {
            const isTarget = targets.some(target =>
                category.id.toString() === target || category.slug === target
            );

            if (isTarget) {
                // Fallback: Add class to body
                if (document && document.body) {
                    document.body.classList.add("custom-following-page");
                }
                return true;
            }
        }

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

        // 2. Try controller lookup
        try {
            // We already injected the service, use it directly if model populates
            if (this.discoveryTopicsController && this.discoveryTopicsController.model && this.discoveryTopicsController.model.topics) {
                return this.discoveryTopicsController.model.topics;
            }
            // Fallback lookup if service injection behaves oddly in connectors (sometimes context differs)
            const controller = getOwner(this).lookup("controller:discovery/topics");
            if (controller && controller.model && controller.model.topics) {
                return controller.model.topics;
            }
        } catch (e) {
            console.warn("Could not lookup discovery controller", e);
        }

        return [];
    }

    get bulkSelectEnabled() {
        return this.discoveryTopicsController && this.discoveryTopicsController.bulkSelectEnabled;
    }
}
