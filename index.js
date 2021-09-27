// Docs: https://docs.github.com/en/actions

const core = require('@actions/core');
const github = require('@actions/github');

const getOctokit = () => {
    const token = core.getInput('token');
    return github.getOctokit(token);   
}

try {

    // Get config
    const message = core.getInput('message');
    console.log("message", message)

    // Get octokit
    const octokit = getOctokit()
    const ctx = github.context
    
    // console.log("ctx.eventName", ctx.eventName)
    // console.log("Payload", JSON.stringify(github.context.payload, undefined, 2))

    // Check if event is issue
    // Docs: https://docs.github.com/en/actions/learn-github-actions/events-that-trigger-workflows
    if (ctx.eventName === "issues") {
        // Check if new issue is opened
        if (ctx.payload.action === "opened") {
          // Docs: https://octokit.github.io/rest.js/v18#issues
          octokit.rest.issues.createComment({
            owner: ctx.repo.owner,
            repo: ctx.repo.repo,
            body: message,
            issue_number: ctx.issue.number     
          })
        }
    }
} catch (error) {
  core.setFailed(error.message);
}