import React from "react";
import { DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { CartProvider } from "./src/context/CartContext";
import BrandLogo from "./src/components/BrandLogo";
import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import VendorsScreen from "./src/screens/VendorsScreen";
import VendorDetailScreen from "./src/screens/VendorDetailScreen";
import CheckoutScreen from "./src/screens/CheckoutScreen";
import OrdersScreen from "./src/screens/OrdersScreen";
import { colors } from "./src/theme";

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Vendors: undefined;
  VendorDetail: { vendorId: string; vendorName: string };
  Checkout: undefined;
  Orders: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.paper,
    card: colors.paper,
    border: colors.border,
    text: colors.ink,
    primary: colors.brand
  }
};

const appScreenOptions = {
  headerStyle: {
    backgroundColor: colors.paper
  },
  headerShadowVisible: false,
  headerTintColor: colors.ink,
  headerTitleStyle: {
    color: colors.ink,
    fontWeight: "600" as const
  },
  contentStyle: {
    backgroundColor: colors.paper
  }
};

const RootNavigator = () => {
  const auth = useAuth();

  return (
    <NavigationContainer theme={navTheme}>
      {!auth.token ? (
        <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator screenOptions={appScreenOptions}>
          <Stack.Screen
            name="Vendors"
            component={VendorsScreen}
            options={{
              headerTitle: () => <BrandLogo compact />,
              title: "Anbieter"
            }}
          />
          <Stack.Screen
            name="VendorDetail"
            component={VendorDetailScreen}
            options={({ route }) => ({ title: route.params.vendorName })}
          />
          <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: "Checkout" }} />
          <Stack.Screen name="Orders" component={OrdersScreen} options={{ title: "Bestellungen" }} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <RootNavigator />
      </CartProvider>
    </AuthProvider>
  );
}
