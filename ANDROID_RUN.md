# Running Brady and the Magical Cake on Android

This build can run locally on a Pixel phone without jailbreaking.

## Recommended path

1. Copy `brady-magical-cake-phone-build.zip` to the Pixel.
2. Unzip it on the phone.
3. Install a simple local web server app from the Play Store, such as:
   - Simple HTTP Server
   - HTTP Server
   - KSWEB
4. In the server app, choose the unzipped `dist` folder as the web root.
5. Start the server.
6. Open the local URL it shows, usually something like:

   ```text
   http://127.0.0.1:8080/
   ```

7. Rotate the phone landscape and play.

## Why not just tap index.html?

Some Android browsers block parts of modern JavaScript games when opened directly from local files. Serving the folder through a local web server avoids that while still keeping everything on the phone.

## Alternative with Termux

If Termux is installed:

```bash
cd /sdcard/Download/dist
python3 -m http.server 8080
```

Then open:

```text
http://127.0.0.1:8080/
```
