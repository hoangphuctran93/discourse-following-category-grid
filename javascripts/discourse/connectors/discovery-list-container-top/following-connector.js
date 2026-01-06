import Component from "@glimmer/component";
import { inject as service } from "@ember/service";
import { getOwner } from "@ember/application";

export default class FollowingConnector extends Component {
    @service router;
    @service discovery;

    constructor() {
        super(...arguments);
        console.error("FollowingConnector: DEBUG ARGS", {
            argsKeys: Object.keys(this.args),
            outletArgsKeys: this.args.outletArgs ? Object.keys(this.args.outletArgs) : 'N/A',
            bulkSelectEnabledInOutletArgs: this.args.outletArgs?.bulkSelectEnabled,
            bulkSelectEnabledInArgs: this.args.bulkSelectEnabled
        });
    }

    get bulkSelectEnabled() {
        // Try all known locations
        if (this.args.outletArgs?.bulkSelectEnabled !== undefined) {
            return this.args.outletArgs.bulkSelectEnabled;
        }
        if (this.discovery.bulkSelectEnabled !== undefined) {
            return this.discovery.bulkSelectEnabled;
        }
        // Fallback for debugging
        return false;
    }

    get shouldRender() {
        const category = this.args.outletArgs?.category;
        const settingValue = settings.following_grid_category;

        if (!category || !settingValue) {
            return false;
        }

        let targets;
        if (Array.isArray(settingValue)) {
            targets = settingValue.map(t => t.toString());
        } else {
            targets = settingValue.toString().split("|").map(t => t.trim());
        }
        targets = targets.filter(Boolean);

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
}
