# babel-plugin-rn-remove-unused-code
a babel plugin for removal the unused code in RN

## Install
`npm install --save babel-plugin-rn-remove-unused-code`

## Usage
For Example:
```javascript
// babel.config.js
const presets = ['@babel/preset-react']
const plugins = [
  [
    './dist/index.js',
    {
      imports: {
        ignoreLibraries: ['react'],
        remove: true,
        customImports: {
          libraryName: 'antd',
          libraryDirectory: 'lib',
          customMapping: {
            'Button': 'customPath/Button'
          }
      }
      },
      styles: {
        remove: true,
      },
      propTypes: {
        remove: true,
        onlyProduction: false
      }
    }
  ]
]
module.exports = { presets, plugins }

// Input
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import React, { Component } from 'react';
import { Button, Switch } from 'antd';

export default class Demo extends Component {
    constructor(props) {

    }
    static propTypes = {
        size: PropTypes.number, 
    }
    render () {
        return <View style={styles.style1}>
            <Button></Button>
            <Switch></Switch>
        </View>
    }
};
 
const styles = StyleSheet.create({
    style1: {
        flexDirection: 'row',
    },
    style2: {
        flexDirection: 'row',
    },
})

// Output
import { StyleSheet, View } from 'react-native';
import React, { Component } from 'react';
import Button from "antd/customPath/Button";
import Switch from "antd/lib/Switch";
export default class Demo extends Component {
  constructor(props) {}

  render() {
    return /*#__PURE__*/React.createElement(View, {
      style: styles.style1
    }, /*#__PURE__*/React.createElement(Button, null), /*#__PURE__*/React.createElement(Switch, null));
  }

}
;
const styles = StyleSheet.create({
  style1: {
    flexDirection: 'row'
  }
});
```

## Options
```javascript
Options = {
    imports: {
        ignoreLibraries?: string[], // eg: ['react', 'react-native']
        ignoreFilenames?: string[], // eg: ['test.js']
        remove?: boolean, // default: false
        customImports?: Array<{
            libraryName: string, // eg: 'antd'
            libraryDirectory?: string,  // default: lib
            customMapping?: { // eg: { 'Button': 'lib/Button' }
                [key: string]: string
            }
        }>
    },
    styles: {
        ignoreFilenames?: string[], // the same as imports.ignoreFilenames
        remove?: boolean, // default: false
    },
    propTypes: {
        ignoreFilenames?: string[], // the same as imports.ignoreFilenames
        remove?: boolean, // default: false
        onlyProduction?: boolean // default: false (both production and development)
    }
}
```