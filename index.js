// Docs: https://docs.github.com/en/actions

const core = require('@actions/core');
const github = require('@actions/github');
const failedMsgs = []

const extractRegex = />[\s\w\d:\.]*\r\n>[\s\w\d]*:\s(?<type>[\w-\s:]*)\r\n(>[\s\w\d]*:\s(?<subtype>[\w-\s:]*))?/gm

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
          const matches = extractRegex.exec(issueBody)

          if (!matches) {
            core.setFailed(`Unable to find issueType or issueSubType. Match value: ${matches}. issue body: ${issueBody}`);
          }

          const issueType = matches.groups.type.toLowerCase()
          const issueSubtype = matches.groups.subtype.toLowerCase()

          const { data: repoLabels } = await octokit.rest.issues.listLabelsForRepo({
            owner: ctx.repo.owner,
            repo: ctx.repo.repo
          })

          const repoLabelsName = repoLabels.map(l => l.name)
          const labelsToAdd = []

          // If `issueType` is present in existing repo issues => Push it to `labelsToAdd`.
          // Else mark action as failed at the end and omit adding label to issue. (This is because if we add this to issue then it will create new unwanted label in repo)
          if (!repoLabelsName.includes(issueType)) failedMsgs.push(`label "${issueType}" doesn't exist on repo. Skipping adding ${issueType} label.`)
          else labelsToAdd.push(issueType)

          // Issue subtype is optional
          if (issueSubtype) {
            // If `issueSubtype` is present in existing repo issues => Push it to `labelsToAdd`.
            // Else mark action as failed at the end and omit adding label to issue. (This is because if we add this to issue then it will create new unwanted label in repo)
            if (!repoLabelsName.includes(issueSubtype)) failedMsgs.push(`label "${issueSubtype}" doesn't exist on repo.  Skipping adding ${issueSubtype} label.`)
            else labelsToAdd.push(issueSubtype)
          }

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