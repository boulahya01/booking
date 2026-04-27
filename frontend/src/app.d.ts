/// <reference types="@sveltejs/kit" />

declare global {
  namespace App {
    interface Error {
      message: string
      errorId?: string
    }
    interface Locals {
      user?: import('./lib/types').Profile | null
    }
    interface PageData {}
    interface Platform {}
  }
}

export {}
