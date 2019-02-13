const path = require('path')
const copyWebpackPlugin = require('copy-webpack-plugin')

module.exports = {
  mode: 'development',
  entry: './src/main.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: './main.js'
  },
  plugins: [
    copyWebpackPlugin([{
      from: path.resolve(__dirname, 'src/index.html'),
      to: path.resolve(__dirname, 'dist/index.html')
    }])
  ],
  devServer: {
    contentBase: path.join(__dirname, 'dist'),
    compress: true,
    port: 9000
  },
  devtool: 'eval-source-map',
  watch: true
}