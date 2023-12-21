# Comment on new issue

This actions comments with your desired message whenever new issue is created.

## Inputs

### `token`

#### *Default: ${{ github.token }}*

GitHub token

### `message`*

Markdown content you want to post as comment

### `ignore-label`

Ignore posting comment when this label is found on the issue. This is helpful if you have internal issues and you apply label to them and you don't want this action to post comment each time.

### `only-if-label`

Only post comment if this label is found on the issue. This is helpful in scenarios where you apply specific label to issues where your team will respond. Like in our case all our issue created by customer has `support` label and we want to comment that we will get back you within 1-2 business days.

Do note that if `ignore-label` is also found with this label then action will omit processing.

### `raise-support-using-form-msg`*

Value of this parameter will be commented when new user outside of organization create an issue.

Just after this comment issue will be closed.

### `debug`

Boolean value which will tell action to log the action it performs. Useful for debugging.

## Example Usage

> NOTE: Do update action version `jd-solanki/gh-action-comment-on-new-issue@{YOUR_DESIRED_VERSION}`. This will help you keep using this action if we introduce breaking changes.

### Comment on each issue with specified message

```yml
on:
  issues:
    types: [opened]

jobs:
  comment_on_new_issue:
    runs-on: ubuntu-latest
    name: Job for commenting on new issue
    steps:
      - name: Comment
        uses: jd-solanki/gh-action-comment-on-new-issue@v2.0.3
        with:
          message: 'Welcome to the repo :)'
          raise-support-using-form-msg: 'Please raise issue using our support form'
```

### Comment on issue which has specific label

```yml
on:
  issues:
    types: [opened]

jobs:
  comment_on_new_issue:
    runs-on: ubuntu-latest
    name: Job for commenting on new issue
    steps:
      - name: Comment
        uses: jd-solanki/gh-action-comment-on-new-issue@v2.0.3
        with:
          message: 'Welcome to the repo :)'
          raise-support-using-form-msg: 'Please raise issue using our support form'
          only-if-label: 'support'
```

### Ignore Commenting on issue which has specific label

```yml
on:
  issues:
    types: [opened]

jobs:
  comment_on_new_issue:
    runs-on: ubuntu-latest
    name: Job for commenting on new issue
    steps:
      - name: Comment
        uses: jd-solanki/gh-action-comment-on-new-issue@v2.0.3
        with:
          message: 'Welcome to the repo :)'
          raise-support-using-form-msg: 'Please raise issue using our support form'
          ignore-label: 'internal'
```

### Turn on debugging

```yml
on:
  issues:
    types: [opened]

jobs:
  comment_on_new_issue:
    runs-on: ubuntu-latest
    name: Job for commenting on new issue
    steps:
      - name: Comment
        uses: jd-solanki/gh-action-comment-on-new-issue@v2.0.3
        with:
          message: 'Welcome to the repo :)'
          raise-support-using-form-msg: 'Please raise issue using our support form'
          debug: true
```
