# Design Considerations

## FORMS

Use forms for any sort of user interaction. This lets people use the keyboard naturally.

## TOOLS

### INPUT vs. JavaScript

If something should be persistent, like color choices, use an `<input>`.

If something is temporary, like selection or keeping track of old positions, use JavaScript.

1. Doing so allows clear definitions of intent
2. Persistent data should be decoupled from saving
3. Persistent data will be handled by the page