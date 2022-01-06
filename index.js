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
    const raiseSupportUsingFormMsg = core.getInput('raise-support-using-form-msg');
    core.info(`raiseSupportUsingFormMsg: ${raiseSupportUsingFormMsg}`)

    const message = core.getInput('message');
    core.info(`message: ${message}`)

    const ignoreLabel = core.getInput('ignore-label');
    core.info(`ignoreLabel: ${ignoreLabel}`)

    const onlyIfLabel = core.getInput('only-if-label');
    core.info(`onlyIfLabel: ${onlyIfLabel}`)

    // Get octokit
    const octokit = getOctokit()
    const ctx = github.context
    
    // console.log("ctx.eventName: ", ctx.eventName)
    // console.log("Payload: ", JSON.stringify(github.context.payload, undefined, 2))

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

          // Extract issue type & sub type from comment
          const issueBody = ctx.payload.issue.body
          const matches = labelsRegex.exec(issueBody)

          // ℹ️ If matches is found => Issue need labels to attached & created using our issue form
          if (matches) {
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

            // Post Comment if issue is support
            if (labelsToAdd.includes("support")) {
              octokit.rest.issues.createComment({
                owner: ctx.repo.owner,
                repo: ctx.repo.repo,
                body: message,
                issue_number: ctx.issue.number     
              })
            } else {
              core.info(`"support" label is not found. Ignoring adding comment to the issue.`)
            }
          } else {
            
            console.log("making request...")

            // ℹ️ Check if user is organization member
            const { status } = await octokit.rest.orgs.checkMembershipForUser({
              org: ctx.repo.owner,
              username: ctx.payload.issue.user.login
            })

            console.log("status")

            /*
              status ==== 204 => org member
              status ==== 302 => not org member
              status ==== 404 => unable to identify
            */

            if (status === 204) {
              core.info(`Issue labels comment not found in issue body. Ignoring adding labels & welcome message as this issue is raised by organization member.`)
            } else if (status === 302) {

              core.info(`Issue isn't created by organization member.`)

              // Add comment for raising issue using form
              octokit.rest.issues.createComment({
                owner: ctx.repo.owner,
                repo: ctx.repo.repo,
                body: raiseSupportUsingFormMsg,
                issue_number: ctx.issue.number
              })
  
              // Close the issue
              await octokit.rest.issues.update({
                owner: ctx.repo.owner,
                repo: ctx.repo.repo,
                issue_number: ctx.payload.issue.number,
                state: 'closed'
              })
            } else if (status === 404) {
              core.info("unable to find if user is member or not")
            }

          }

          if (failedMsgs.length) core.setFailed(`Errors:\n${failedMsgs.join("\n")}`)
        }
    }
} catch (error) {
  core.setFailed(error.message);
}
})()