const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname, {
  autoWrapExpoRouterErrorBoundary: true,
});

config.transformer = {
  ...config.transformer,
  unstable_transformProfile: 'hermes-stable',
};

module.exports = config;
