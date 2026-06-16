# Weather

Fetch and display current local weather.

Steps:
1. Run `curl -s "wttr.in/?format=j1"` to get weather JSON (uses IP geolocation automatically).
2. Parse and display in a clean summary: location, condition, temperature (°C and °F), humidity, wind speed/direction, and feels-like temperature.
3. Also run `curl -s "wttr.in/?format=3"` for a compact one-liner summary.
4. If the user passed a location argument (`$ARGUMENTS`), use `wttr.in/$ARGUMENTS?format=j1`. Otherwise (no arguments), use `wttr.in/Santa+Cruz+de+Tenerife?format=j1` as the default location.

Present the output in a readable format, not raw JSON.
