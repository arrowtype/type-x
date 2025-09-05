const webpack = require("webpack");
const CopyPlugin = require("copy-webpack-plugin");
let mode = "development";

module.exports = {
	mode: mode,
	devtool: mode === "development" ? "source-map" : false,
	performance: {
		maxEntrypointSize: 500000
	},
	entry: {
		popup: "./src/popup.ts",
		content: "./src/content.js",
		"service-worker": "./src/service-worker.js"
	},
	module: {
		rules: [
			{
				test: /\.ts$/,
				use: "ts-loader",
				exclude: /node_modules/
			}
		]
	},
	output: {
		filename: "[name].js",
		chunkFilename: "[name].bundle.js",
		clean: true
	},
	resolve: {
		extensions: [".ts", ".js", "..."],
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
