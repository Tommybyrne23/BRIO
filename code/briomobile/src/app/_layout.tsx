import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="(auth)/sign-in" options={{ title: "Sign in" }} />
      <Stack.Screen name="(auth)/sign-up" options={{ title: "Sign up" }} />
    </Stack>
  );
}
