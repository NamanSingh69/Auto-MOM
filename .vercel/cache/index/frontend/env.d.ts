declare module '@tailwindcss/vite' {
    import { PluginOption } from 'vite';
    const tailwindcss: () => PluginOption | PluginOption[];
    export default tailwindcss;
}
