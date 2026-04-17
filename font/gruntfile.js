const path = require("path")
const TerserPlugin = require("terser-webpack-plugin");

module.exports = function (grunt) {
  grunt.initConfig({
    webpack: {
      dev: {
        watch: true,
        mode: "development",
        entry: {
          "./dist/index": "./src/index"
        },
        output: {
          path: path.resolve(__dirname, "./"),
          filename: "[name].js"
        },
        resolve: {
          modules: ["node_modules"],
          extensions: [".tsx", ".ts", ".js"]
        },
        module: {
          rules: [{
            test: /\.glsl$/,
            loader: "webpack-glsl-loader"
          },
          {
            test: /\.tsx?$/,
            use: "ts-loader",
            exclude: /node_modules/,
          }
          ]
        }
      },
      prod: {
        mode: "production",
        optimization: {
          minimizer: [new TerserPlugin()],
        },
        entry: {
          "./dist/index": "./src/index"
        },
        output: {
          path: path.resolve(__dirname, "./"),
          filename: "[name].js"
        },
        resolve: {
          modules: ["node_modules"],
          extensions: [".tsx", ".ts", ".js"]
        },
        module: {
          rules: [{
            test: /\.glsl$/,
            loader: "webpack-glsl-loader"
          },
          {
            test: /\.tsx?$/,
            use: "ts-loader",
            exclude: /node_modules/,
          }
          ]
        }
      }
    }
  })
  grunt.loadNpmTasks("grunt-webpack")
  grunt.registerTask("build:prod", ["webpack:prod"])
  grunt.registerTask("build:dev", ["webpack:dev"])
  grunt.registerTask("default", ["build:dev"])
}