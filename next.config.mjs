/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @react-pdf/renderer (utilisé pour l'export PDF du carnet de santé) tire
  // quelques dépendances pensées pour Node ; ces modules ne servent à rien
  // côté navigateur, on les neutralise pour éviter une erreur de build.
  webpack: (config) => {
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, zlib: false, canvas: false };
    return config;
  },
};

export default nextConfig;
