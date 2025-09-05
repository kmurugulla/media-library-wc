# CSS Utility Functions

## getStyles Utility

The `getStyles` utility function provides a consistent way to import and use CSS files with Lit components.

### Usage

For any component that has a corresponding CSS file with the same name:

```javascript
// src/components/my-component/my-component.js
import { html } from 'lit';
import { getStyles } from '../../utils/get-styles.js';
import myComponentStyles from './my-component.css?inline';

class MyComponent extends LitElement {
  static styles = getStyles(myComponentStyles);
  
  render() {
    return html`<div class="my-component">Hello World</div>`;
  }
}
```

```css
/* src/components/my-component/my-component.css */
:host {
  --my-primary: #3b82f6;
}

.my-component {
  color: var(--my-primary);
  padding: 1rem;
}
```

### Benefits

- **Consistent Pattern**: All components follow the same CSS import pattern
- **Type Safety**: Works with TypeScript and provides better IDE support
- **HMR Support**: Hot module replacement works for CSS changes
- **Build Optimization**: CSS is properly inlined during build
- **Scoping**: Maintains Lit's CSS scoping and encapsulation

### File Naming Convention

- JavaScript file: `component-name.js`
- CSS file: `component-name.css`
- Import: `import componentStyles from './component-name.css?inline';`

### Example for New Components

1. Create your component directory: `src/components/new-component/`
2. Create JavaScript file: `new-component.js`
3. Create CSS file: `new-component.css`
4. Use the utility:

```javascript
import { getStyles } from '../../utils/get-styles.js';
import newComponentStyles from './new-component.css?inline';

class NewComponent extends LitElement {
  static styles = getStyles(newComponentStyles);
  // ... rest of component
}
```
