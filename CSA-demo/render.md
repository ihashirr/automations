# Render

Use this command:

```powershell
npm run render:crisp
```

Output:

```text
out/main-rtx3050-crisp-master.mp4
```

This renders PNG frames first, then encodes with NVIDIA `h264_nvenc`.

## Change Quality

Default is `RENDER_QP=12`. Lower QP means sharper and bigger file.

```powershell
$env:RENDER_QP="10"; npm run render:crisp
```

Use `8-10` for very crisp, `12` for good default, `16+` for smaller files.

## Change Output File

```powershell
$env:RENDER_OUT="out/final.mp4"; npm run render:crisp
```

## Use Bitrate Mode

```powershell
$env:RENDER_MODE="vbr"; $env:RENDER_BITRATE="60M"; $env:RENDER_MAXRATE="80M"; npm run render:crisp
```

Main knobs:

```text
RENDER_QP=12
RENDER_MODE=constqp | vbr
RENDER_CQ=16
RENDER_BITRATE=40M
RENDER_MAXRATE=60M
RENDER_PRESET=p7
RENDER_PROFILE=high
RENDER_PIXEL_FORMAT=yuv420p
RENDER_OUT=out/main-rtx3050-crisp-master.mp4
RENDER_FPS=60
RENDER_COMP=Main
```
