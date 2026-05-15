declare module '*.md' {
  const content: string;
  export default content;
}

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      APP_PRIVATE_KEY: string
      APP_CLIENT_ID: string
      GITHUB_REPOSITORY: string
      OPENROUTER_API_KEY: string
      COMMIT_AUTHOR_NAME?: string
      COMMIT_AUTHOR_EMAIL?: string
      PR_NUMBER?: string
    }
  }
}
