# Comment on new issue

This actions comments with your desired message whenever new issue is created. Comment will be posted by the author via GitHub personal token.

## Inputs

### `token`*

GitHub personal token

### `message`*

Markdown content you want to post as comment

## Example Usage

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
        uses: jd-0001/gh-action-comment-on-new-issue@v1.1.0
        with:
          token: ${{ secrets.GH_TOKEN }}
          message: 'Welcome to the repo :)'
```
