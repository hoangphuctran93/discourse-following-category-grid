import Component from "@glimmer/component";
import { inject as service } from "@ember/service";

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
        return this.args.outletArgs?.topics;
    }
}
