import fetch from 'node-fetch'

async function api(endpoint) {
  const response = await fetch(`https://api.github.com/repos/${endpoint}`)
  return await response.json()
}

// Great for downloads with few sub directories on big repos
// Cons: many requests if the repo has a lot of nested dirs
export async function viaContentsApi({
  user,
  repository,
  ref = 'HEAD',
  directory,
  getFullData = false,
}) {
  const files = []
  const contents = await api(`${user}/${repository}/contents/${directory}?ref=${ref}`)

  if (contents.message === 'Not Found') {
    return []
  }

  if (contents.message) {
    throw new Error(contents.message)
  }

  for (const item of contents) {
    if (item.type === 'file') {
      files.push(getFullData ? item : item.path)
    } else if (item.type === 'dir') {
      files.push(getFullData ? item : item.path)
    }
  }

  return files
}
