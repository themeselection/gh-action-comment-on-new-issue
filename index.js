// Docs: https://docs.github.com/en/actions

const core = require('@actions/core')
const github = require('@actions/github')

const failedMsgs = []

const labelsRegex = /<!-- Issue Labels: (?<labels>[\w-\s:,]*) -->/gm

const getOctokit = () => {
  const token = core.getInput('token')
  return github.getOctokit(token)
}

const hasLabel = (issue, label) => {
  const labelNames = issue.labels.map(issueObj => issueObj.name)
  return labelNames.includes(label)
}

// TODO: Only send this message on specific label
(async () => {
  try {
    // Get config
    const debug = Boolean(core.getInput('debug'))
    core.info(`debug: ${debug}`)

    const raiseSupportUsingFormMsg = core.getInput('raise-support-using-form-msg')
    if (debug) core.info(`raiseSupportUsingFormMsg: ${raiseSupportUsingFormMsg}`)

    const message = core.getInput('message')
    if (debug) core.info(`message: ${message}`)

    const ignoreLabel = core.getInput('ignore-label')
    if (debug) core.info(`ignoreLabel: ${ignoreLabel}`)

    const onlyIfLabel = core.getInput('only-if-label')
    if (debug) core.info(`onlyIfLabel: ${onlyIfLabel}`)

    // Get octokit
    const octokit = getOctokit()
    const ctx = github.context

    if (debug) core.info('ctx.eventName: ', ctx.eventName)
    if (debug) core.info('Payload: ', JSON.stringify(github.context.payload, undefined, 2))

    // Check if event is issue
    // Docs: https://docs.github.com/en/actions/learn-github-actions/events-that-trigger-workflows
    if (ctx.eventName === 'issues') {
      // Check if new issue is opened
      if (ctx.payload.action === 'opened') {
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
        if (debug) core.info('issueBody: ', issueBody)

        const matches = labelsRegex.exec(issueBody)
        if (debug) core.info('labels regex matches: ', matches)

        // ℹ️ If matches is found => Issue need labels to attached & created using our issue form
        if (matches) {
          const issueCsv = matches.groups.labels
          const labels = issueCsv.split(',').map(i => i.trim())

          const { data: repoLabels } = await octokit.rest.issues.listLabelsForRepo({
            owner: ctx.repo.owner,
            repo: ctx.repo.repo,
          })

          if (debug) core.info('repoLabels: ', repoLabels)
          const repoLabelsName = repoLabels.map(l => l.name)
          const labelsToAdd = []

          // Loop over all markdown labels to check if every label is present in repo
          labels.forEach(label => {
            // If `label` is present in existing repo issues => Push it to `labelsToAdd`.
            // Else mark action as failed at the end and omit adding label to issue.
            // (This is because if we add this to issue then it will create new unwanted label in repo)
            if (!repoLabelsName.includes(label)) failedMsgs.push(`label "${label}" doesn't exist on repo. Skipping adding ${label} label.`)
            else labelsToAdd.push(label)
          })

          if (labelsToAdd.length) {
            // Add labels
            octokit.rest.issues.addLabels({
              issue_number: ctx.payload.issue.number,
              owner: ctx.repo.owner,
              repo: ctx.repo.repo,
              labels: labelsToAdd,
            })
          }

          // Post Comment if issue is support
          if (labelsToAdd.includes('support')) {
            octokit.rest.issues.createComment({
              owner: ctx.repo.owner,
              repo: ctx.repo.repo,
              body: message,
              issue_number: ctx.issue.number,
            })
          } else {
            core.info('"support" label is not found. Ignoring adding comment to the issue.')
          }
        } else {
          try {
            if (debug) core.info('Making request for checking user membership')

            // ℹ️ Check if user is organization member
            // https://docs.github.com/en/rest/reference/orgs#check-organization-membership-for-a-user
            const { status } = await octokit.rest.orgs.checkMembershipForUser({
              org: ctx.repo.owner,
              username: ctx.payload.issue.user.login,
            })

            /*
                status ==== 204 => org member
                status ==== 302 => requester is not member
                status ==== 404 => requester is member and user is not member
              */

            if (debug) core.info(`'Request response status: ${status}'`)

            core.info(`"Membership of user response status: ${status}"`)

            if (status === 204) {
              core.info('Issue labels comment not found in issue body. Ignoring adding labels & welcome message as this issue is raised by organization member.')
            }
          } catch (error) {
            if (debug) core.info('Request threw exception. Handled in catch block.')
            if (debug) core.info(`'Error response status: ${error.response.status}'`)

            core.info('Error:')
            // core.info(error.response)
            core.info(error.response.data.message)

            // 404 if user is not member
            if (error.response.status === 404) {
              core.info('Got 404 as  request response status. Hence, user is not org member')
              core.info('Creating comment to raise the issue using support form')
              // Add comment for raising issue using form
              octokit.rest.issues.createComment({
                owner: ctx.repo.owner,
                repo: ctx.repo.repo,
                body: raiseSupportUsingFormMsg,
                issue_number: ctx.issue.number,
              })

              core.info('Closing this issue as issue is not created using support form and creator is not org member')

              // Close the issue
              await octokit.rest.issues.update({
                owner: ctx.repo.owner,
                repo: ctx.repo.repo,
                issue_number: ctx.payload.issue.number,
                state: 'closed',
              })
            } else {
              core.info(`"Unexpected response: ${error.response.status}"`)
            }
          }
        }

        if (failedMsgs.length) core.setFailed(`Errors:\n${failedMsgs.join('\n')}`)
      }
    }
  } catch (error) {
    core.setFailed(error.message)
  }
})()
