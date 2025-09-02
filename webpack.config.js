const webpack = require("webpack");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
	mode: "production",
	performance: {
		maxEntrypointSize: 500000
	},
	entry: "./src/popup.js",
	output: {
		filename: "popup.js",
		chunkFilename: "[name].bundle.js",
		clean: true
	},
	resolve: {
		fallback: {
			fs: false,
			buffer: require.resolve("buffer"),
			string_decoder: require.resolve("string_decoder/"),
			stream: require.resolve("stream-browserify"),
			util: require.resolve("util"),
			process: require.resolve("process/browser")
		}
	},
	plugins: [
		new webpack.ProvidePlugin({
			Buffer: ["buffer", "Buffer"],
			process: "process/browser"
		}),
		new CopyPlugin({
			patterns: [
				{ from: "src/icons", to: "icons/" },
				{ from: "src/fonts", to: "fonts/" },
				{ from: "src/*.html", to: "[name][ext]" },
				{ from: "src/*.css", to: "[name][ext]" },
				{ from: "src/manifest.json", to: "manifest.json" }
			]
		})
	]
};
