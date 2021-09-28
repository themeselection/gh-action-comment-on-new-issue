// Docs: https://docs.github.com/en/actions

const core = require('@actions/core');
const github = require('@actions/github');

const getOctokit = () => {
    const token = core.getInput('token');
    return github.getOctokit(token);   
}

const hasLabel = (issue, label) => {
    const labelNames = issue.labels.map(issueObj => issueObj.name)
    return labelNames.includes(label)
}

// TODO: Only send this message on specific label

try {

    // Get config
    const message = core.getInput('message');
    core.info(`message: ${message}`)

    const ignoreLabel = core.getInput('ignore-label');
    core.info(`ignoreLabel: ${ignoreLabel}`)

    const onlyIfLabel = core.getInput('only-if-label');
    core.info(`onlyIfLabel: ${onlyIfLabel}`)

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

          // If `onlyIfLabel` label is provided & that label is not present on issue => ignore
          if (onlyIfLabel && !hasLabel(ctx.payload.issue, onlyIfLabel)) {
              core.info(`Ignoring as onlyIfLabel "${onlyIfLabel}" is not present on issue. Exiting.`)
              return
          }

          // If `ignoreLabel` label is provided & that label is present on issue => ignore
          if (ignoreLabel && hasLabel(ctx.payload.issue, ignoreLabel)) {
              core.info(`Ignoring as ignoreLabel "${ignoreLabel}" is present on issue. Exiting.`)
              return
          }

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