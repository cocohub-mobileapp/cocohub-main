import { useState } from'react';

type InitialRoute = {
  initialRouteName: string;
  initialParams: { [key: string]: any };
};

const useRoute = () => {
  const [initialRoute, setInitialRoute] = useState<InitialRoute>({
    initialRouteName: 'Home',
    initialParams: {},
  });

  const setInitialRoute = (route: { screen: string; params?: { [key: string]: any } }) => {
    setInitialRoute({
      initialRouteName: route.screen,
      initialParams: route.params || {},
    });
  };

  return { initialRoute, setInitialRoute };
};

export default useRoute;