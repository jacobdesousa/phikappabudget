/** @type {import('next').NextConfig} */
const nextConfig = {
  // `next build` and `next dev` both write to .next by default, so running a
  // build while the dev server is up corrupts its chunks ("Cannot find module
  // './undefined'"). Set NEXT_BUILD_DIR to verify a build out of the way:
  //   NEXT_BUILD_DIR=.next-verify npx next build
  distDir: process.env.NEXT_BUILD_DIR || ".next",
}

module.exports = nextConfig
