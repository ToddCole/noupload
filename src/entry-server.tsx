import { renderToString } from 'react-dom/server';
import { App, RoutePath } from './App';

export function render(route: RoutePath): string {
  return renderToString(<App initialRoute={route} />);
}
