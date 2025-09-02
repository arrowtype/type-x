module.exports = {
	mode: "production",
	performance: {
		maxEntrypointSize: 500000
	},
	entry: "./src/popup.js",
	output: {
		filename: "popup.js",
		chunkFilename: "[name].bundle.js"
	},
    resolve: {
        fallback: {
            fs: false,
            "buffer": require.resolve("buffer"),
            "string_decoder": require.resolve("string_decoder/"),
            "stream": false,
            "util": require.resolve("util")
        }
    }
};
