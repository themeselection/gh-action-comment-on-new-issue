// Docs: https://docs.github.com/en/actions

const core = require('@actions/core');
const github = require('@actions/github');
const failedMsgs = []

const labelsRegex = /<!-- Issue Labels: (?<labels>[\w-\s:,]*) -->/gm

const getOctokit = () => {
    const token = core.getInput('token');
    return github.getOctokit(token);   
}

const hasLabel = (issue, label) => {
    const labelNames = issue.labels.map(issueObj => issueObj.name)
    return labelNames.includes(label)
}

// TODO: Only send this message on specific label
(async () => {
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
    
    console.log("ctx.eventName: ", ctx.eventName)
    console.log("Payload: ", JSON.stringify(github.context.payload, undefined, 2))

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

          // Post Comment
          octokit.rest.issues.createComment({
            owner: ctx.repo.owner,
            repo: ctx.repo.repo,
            body: message,
            issue_number: ctx.issue.number     
          })

          // Extract issue type & sub type from comment
          const issueBody = ctx.payload.issue.body
          const matches = labelsRegex.exec(issueBody)

          if (!matches) {
            core.setFailed(`Unable to find issueType or issueSubType. Match value: ${matches}. issue body: ${issueBody}`);
            return
          }

          const issueCsv = matches.groups.labels
          const labels = issueCsv.split(",").map(i => i.trim())

          const { data: repoLabels } = await octokit.rest.issues.listLabelsForRepo({
            owner: ctx.repo.owner,
            repo: ctx.repo.repo
          })

          const repoLabelsName = repoLabels.map(l => l.name)
          const labelsToAdd = []

          // Loop over all markdown labels to check if every label is present in repo
          labels.forEach(label => {
            // If `label` is present in existing repo issues => Push it to `labelsToAdd`.
            // Else mark action as failed at the end and omit adding label to issue. (This is because if we add this to issue then it will create new unwanted label in repo)
            if (!repoLabelsName.includes(label)) failedMsgs.push(`label "${label}" doesn't exist on repo. Skipping adding ${label} label.`)
            else labelsToAdd.push(label)
          })

          if (labelsToAdd.length) {
            // Add labels
            octokit.rest.issues.addLabels({
                issue_number: ctx.payload.issue.number,
                owner: ctx.repo.owner,
                repo: ctx.repo.repo,
                labels: labelsToAdd
            })
          }

          if (failedMsgs.length) core.setFailed(`Errors:\n${failedMsgs.join("\n")}`)
        }
    }
} catch (error) {
  core.setFailed(error.message);
}
})()