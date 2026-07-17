// Allow side-effect imports of the NativeWind global stylesheet.
declare module "*.css";

// Metro bundles *.html as a static asset (see metro.config.js); the require()
// resolves to an asset module id consumed via expo-asset (Asset.fromModule).
declare module "*.html" {
  const asset: number;
  export default asset;
}
