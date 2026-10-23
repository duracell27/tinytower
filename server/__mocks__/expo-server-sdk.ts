// Manual mock for expo-server-sdk (ESM-only package, incompatible with ts-jest)
const mockExpoInstance = {
  sendPushNotificationsAsync: jest.fn(),
};

const MockExpo = jest.fn(() => mockExpoInstance);
(MockExpo as any).isExpoPushToken = jest.fn().mockReturnValue(true);

export default MockExpo;
