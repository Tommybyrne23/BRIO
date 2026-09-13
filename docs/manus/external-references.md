# External technical references

The implementation uses the repository-installed Next.js 16.3.4 documentation under `code/brioweb/node_modules/next/dist/docs/` for route handlers, Proxy, and Progressive Web App behavior. Route handlers use Web Request/Response APIs and are uncached by default. Next 16 deprecates `middleware.js` in favor of `proxy.js`. The PWA guide specifies `app/manifest.ts`, valid 192px and 512px icons, HTTPS, iOS Share > Add to Home Screen guidance rather than relying on `beforeinstallprompt`, and no-cache/no-store headers for the service worker.

Expo SDK 57 documentation was read from the official SDK reference and app configuration pages. SDK 57 targets React Native 0.86, React 19.2.3, Node 22.13+, iOS 16.4+, and Xcode 26.4+. Expo config plugins apply through prebuild/managed builds; the repository's `app.json` remains the source for HealthKit native configuration and generated `ios/` files remain disposable.

## References

[1]: https://docs.expo.dev/versions/v57.0.0/ "Expo SDK 57 reference"
[2]: https://docs.expo.dev/versions/v57.0.0/config/app/ "Expo SDK 57 app configuration"
[3]: https://nextjs.org/docs/app/guides/progressive-web-apps "Next.js Progressive Web Apps guide"
