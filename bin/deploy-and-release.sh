#!/bin/bash

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
VERSION_FILE="${REPO_ROOT}/package.json"

main() {
    header "Checking repo is clean"
    abort_if_uncommitted_changes_present
    abort_if_not_uptodate_with_remotes

    NEW_VERSION=$(get_new_version)
    header "Going to deploy, tag and push version ${NEW_VERSION}"
    wait_for_confirmation

    subheader "Creating release branch"
    checkout_release_branch
    subheader "Bumping version"
    bump_version
    commit_version_bump

    header "Running deploy script"
    run_deploy_script

    echo ""
    echo "${NEW_VERSION} has been deployed to staging app."
    echo "Test that all is good and then we'll deploy to production"
    wait_for_confirmation
    run_deploy_script --production

    echo ""
    echo "App has been deployed to production."
    echo "Test that all is good and then we'll continue with tag creation and pushing"
    wait_for_confirmation

    header "Merging, tagging, and pushing"
    run_merge_script
}

abort_if_uncommitted_changes_present() {
    if ! git diff-index --quiet HEAD ; then
        echo "$0: Uncommitted changes present aborting. Either stash or commit."
        exit 2
    fi
}

abort_if_not_uptodate_with_remotes() {
    abort_if_not_uptodate_with_remote master
    abort_if_not_uptodate_with_remote develop
}

abort_if_not_uptodate_with_remote() {
    local branch local_rev remote_rev base_rev
    branch=${1:-HEAD}

    local_rev=$(git rev-parse ${branch})
    if [ "${branch}" == "HEAD" ] ; then
        remote_rev=$(git rev-parse @{upstream})
    else
        remote_rev=$(git rev-parse origin/${branch})
    fi
    if [ "${branch}" == "HEAD" ] ; then
        base_rev=$(git merge-base ${branch} @{upstream})
    else
        base_rev=$(git merge-base ${branch} origin/${branch})
    fi

    if [ $local_rev = $remote_rev ]; then
        # Everything is good.
        return 0
    elif [ $local_rev = $base_rev ]; then
        echo "Local branch (${branch}) not up-to-date.  You need to pull in the remote changes."
        exit 3
    elif [ $remote_rev = $base_rev ]; then
        echo "Local branch (${branch}) has unpushed changes.  Oops!"
        exit 4
    else
        echo "Local and remote branches have diverged.  Oh dear!!"
        exit 5
    fi
}

get_current_version() {
    cat package.json \
        | jq -r .version
}

get_new_version() {
    get_current_version \
      | awk 'BEGIN { FS="." } { print $1 "." $2 "." $3 + 1 }'
}

bump_version() {
    yarn version --new-version $(get_new_version) --no-git-tag-version
}

checkout_release_branch() {
    git checkout -b release/"${NEW_VERSION}"
}

commit_version_bump() {
    git commit -m "Bump version to ${NEW_VERSION}" "${VERSION_FILE}"
}

run_deploy_script() {
    "${REPO_ROOT}"/bin/deploy.sh "$@"
}

run_merge_script() {
    "${REPO_ROOT}"/bin/merge-and-tag-release.sh "${NEW_VERSION}"

}

wait_for_confirmation() {
    echo ""
    echo "Press enter to continue or Ctrl-C to abort like a coward"
    read -s
}

header() {
    echo -e "=====> $@"
}

subheader() {
    echo -e "-----> $@"
}

indent() {
    sed 's/^/       /'
}

main "$@"
