import { existsSync, readFileSync, copyFileSync, writeFileSync, renameSync } from 'fs';
import { dirname, resolve } from 'path';
import toml from 'toml';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default function () {
	return {
		async adapt(builder) {
			let netlify_config;

			if (existsSync('netlify.toml')) {
				try {
					netlify_config = toml.parse(readFileSync('netlify.toml', 'utf-8'));
				} catch (err) {
					err.message = `Error parsing netlify.toml: ${err.message}`;
					throw err;
				}
			} else {
				// TODO offer to create one?
				throw new Error(
					'Missing a netlify.toml file. Consult https://github.com/sveltejs/kit/tree/master/packages/adapter-netlify#configuration'
				);
			}

			if (
				!netlify_config.build ||
				!netlify_config.build.publish ||
				!netlify_config.build.functions
			) {
				throw new Error(
					'You must specify build.publish and build.functions in netlify.toml. Consult https://github.com/sveltejs/kit/tree/master/packages/adapter-netlify#configuration'
				);
			}

			const publish = resolve(netlify_config.build.publish);
			const functions = resolve(netlify_config.build.functions);

			builder.copy_static_files(publish);
			builder.copy_client_files(publish);
			builder.copy_server_files(`${functions}/render`);

			// rename app to .mjs
			renameSync(`${functions}/render/app.js`, `${functions}/render/app.mjs`);

			// copy the renderer
			copyFileSync(resolve(__dirname, 'files/render.js'), `${functions}/render/handler.mjs`);

			// copy the entry point
			copyFileSync(resolve(__dirname, 'files/index.cjs'), `${functions}/render/index.js`);

			// create _redirects
			writeFileSync(`${publish}/_redirects`, '/* /.netlify/functions/render 200');

			// prerender
			builder.log.info('Prerendering static pages...');
			await builder.prerender({
				dest: publish
			});
		}
	};
}
