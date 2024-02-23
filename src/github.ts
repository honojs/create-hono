import fetch from 'node-fetch'

const api = async (endpoint: string) => {
  const response = await fetch(`https://api.github.com/repos/${endpoint}`)
  const contents = (await response.json()) as
    | { message: string }
    | { type: string; path: string }[]
  return contents
}

type Options = {
  user: string
  repository: string
  ref: string
  directory: string
}

export const viaContentsApi = async ({
  user,
  repository,
  ref = 'HEAD',
  directory,
}: Options) => {
  const files = []
  const contents = await api(
    `${user}/${repository}/contents/${directory}?ref=${ref}`,
  )

  if ('message' in contents) {
    if (contents.message === 'Not Found') {
      return []
    }
    if (contents.message) {
      throw new Error(contents.message)
    }
  }

  if (Array.isArray(contents)) {
    for (const item of contents) {
      if (item.type === 'file') {
        files.push(item.path)
      } else if (item.type === 'dir') {
        files.push(item.path)
      }
    }
  }

  return files
}
