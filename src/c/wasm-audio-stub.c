/* COPIED from Crash The Stack master e737d21 (src/c/wasm-audio-stub.c), unchanged
 * but for this line and the next (Harkfell ruling D6: copy now, centralize later). */
/* sigil-audio declares native-init sigil__init_sigil_audio_module for its
 * sokol_audio C, which its own package skips on wasm32-wasi (the facade's
 * wasm arm is the WebAudio bridge); sigil-build's generated web register
 * (link-web-application, 0.22.2) still calls every dependency's native-init,
 * so the symbol must exist. It has nothing to initialize here. Compiled
 * for the web config only. */
typedef struct SigilVM SigilVM;

void sigil__init_sigil_audio_module(SigilVM *vm)
{
    (void)vm;
}
