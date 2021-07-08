import { StringLiteral, stringLiteral, unaryExpression, numericLiteral, isImportSpecifier, importDeclaration, importDefaultSpecifier } from '@babel/types';
import { isReactClass, isStatelessComponent } from './util';

export default () => {
    const defaultOptions = {
        imports: {
            ignoreLibraries: [],
            ignoreFilenames: '',
            remove: false,
            customImports: []
        },
        styles: {
            ignoreFilenames: '',
            remove: false,
        },
        propTypes: {
            ignoreFilenames: '',
            remove: false,
            onlyProduction: false
        }
    };
    let globalOptions = null;

    const styleNameSpace:string = 'StyleSheet';
    const styleCreateMethod:string = 'create';

    function remove(path) {
        if (path.parentPath.type === 'ConditionalExpression') {
            path.replaceWith(unaryExpression('void', numericLiteral(0)));
        } else {
            path.remove();
        }
    }

    function isInside(scope, regex) {
        const filename = scope.hub.file?.opts?.filename
        if (!filename) {
          return true
        }
        if (!regex) {
          return false
        }
        return regex.test(filename)
    }

    function isProptypesRemove(path) {
        const { remove, ignoreFilenames, onlyProduction } = globalOptions.propTypes;
        if (!remove || isInside(path.scope, ignoreFilenames)) return false;
        if (onlyProduction) return process.env.NODE_ENV === "production";
        return true;
    }

    const collectNestedObjects = {
        ObjectExpression(path, options) {
            const { identifier, styles } = options;
            const parentPath = path.parentPath;
            if (parentPath.key !== 'init') {
                const propertyKey = `${identifier} ${parentPath.node.key.name}`;
                if (!styles.has(propertyKey)) {
                    remove(parentPath);
                }
            }
        },
    };

    function normalizeOptions(options) {
        const { imports, styles, propTypes } = options;
        if (!Array.isArray(imports.customImports)) {
            imports.customImports = [imports.customImports]
        }
        if (!Array.isArray(imports.ignoreLibraries)) {
            imports.ignoreLibraries = [imports.ignoreLibraries]
        }
        if (imports.ignoreFilenames) {
            imports.ignoreFilenames = new RegExp(imports.ignoreFilenames.join('|'), 'i')
        } else {
            imports.ignoreFilenames = '';
        }
        if (styles.ignoreFilenames) {
            styles.ignoreFilenames = new RegExp(styles.ignoreFilenames.join('|'), 'i')
        } else {
            styles.ignoreFilenames = '';
        }
        if (propTypes.ignoreFilenames) {
            propTypes.ignoreFilenames = new RegExp(propTypes.ignoreFilenames.join('|'), 'i')
        } else {
            propTypes.ignoreFilenames = '';
        }
    }

    return {
        name: 'rn-remove-unused-code',
        visitor: {
            Program(programPath, state) {
                if (!globalOptions) {
                    const options: Object = state.opts;
                    globalOptions = Object.assign({}, defaultOptions, options);
                    normalizeOptions(globalOptions);
                    console.log('enter======>', state.filename)
                }
            },
            ImportDeclaration(path) {
                const { node, scope } = path;
                const specifiers = node.specifiers;
                const sourceValue = node.source.value;
                const imports = globalOptions.imports;
                if (isInside(path.scope, globalOptions.imports.ignoreFilenames)) return;
                if (imports.remove) {
                    for (let i = specifiers.length - 1; i >= 0; i--) {
                        const name = specifiers[i].local.name;
                        const binding = scope.getBinding(name);
                        if (binding?.referencePaths?.length === 0 && !imports.ignoreLibraries.includes(sourceValue)) {
                            remove(binding.path);
                        }
                        if (specifiers.length === 0) {
                            remove(path);
                        }
                    }
                }
                if (imports.customImports.length) {
                    const customImport = imports.customImports.find(imports => imports.libraryName === sourceValue);
                    if (customImport && isImportSpecifier(specifiers[0])) {
                        const newImports = specifiers.map(specifier => {
                            const localName = specifier.local.name;
                            const customUrl = customImport.customMapping?.[localName] ?? `${customImport.libraryDirectory}/${localName}`;
                            return (
                                importDeclaration([importDefaultSpecifier(specifier.local)],
                                stringLiteral(`${customImport.libraryName}/${customUrl}`))
                            )
                        });
                        path.replaceWithMultiple(newImports);
                    }
                }
            },
            ClassProperty(path) {
                if (!isProptypesRemove(path)) return;
                const { node, scope } = path;
                if (node.key?.name === 'propTypes') {
                    const pathClassDeclaration = scope.path;
                    if (isReactClass(pathClassDeclaration.get('superClass'), scope)) {
                        remove(path);
                    }
                }
            },
            ObjectProperty(path) {
                if (!isProptypesRemove(path)) return;
                if (!path.node.computed && path.node.key.name === 'propTypes') {
                    const parent = path.findParent(currentNode => {
                        if (currentNode.type !== 'CallExpression') {
                            return false;
                        }
                        return currentNode.get('callee').node.property?.name === 'createClass';
                    })
                    if (parent) {
                        remove(path);
                    };
                }
            },
            AssignmentExpression(path) {
                if (!isProptypesRemove(path)) return;
                const { node, scope } = path;
                if (node.left.computed || !node.left.property || node.left.property.name !== 'propTypes') {
                    return;
                }
                const className = node.left.object.name;
                const binding = scope.getBinding(className);
                if (!binding) return;
                if (binding.path.isClassDeclaration()) {
                    const superClass = binding.path.get('superClass');
                    if (isReactClass(superClass, scope)) {
                        remove(path);
                    }
                } else if (isStatelessComponent(binding.path)) {
                    remove(path);
                } 
            },
            VariableDeclarator(path) {
                if (!globalOptions.styles.remove || isInside(path.scope, globalOptions.styles.ignoreFilenames)) return;
                const { node, scope } = path;
                if (node.init?.callee?.object?.name === styleNameSpace && node.init?.callee?.property?.name === styleCreateMethod) {
                    const source = path.scope.getBinding(styleNameSpace)?.path?.parentPath?.get('source');
                    if ((source?.node as StringLiteral)?.value !== 'react-native') return;
                    const stylesIdentifier = node.id?.name;
                    const binding = scope.getBinding(stylesIdentifier);
                    let hasSkipCollect:Boolean = false;
                    const stylesCollect:Set<String> = new Set();
                    binding?.referencePaths?.forEach(item => {
                        if (item.container?.property) {
                            const propertyKey:string = `${stylesIdentifier} ${item.container.property.name}`;
                            stylesCollect.add(propertyKey);
                        } else {
                            hasSkipCollect = true;
                        }
                    })
                    if (!hasSkipCollect) {
                        path.traverse(collectNestedObjects, {
                            identifier: stylesIdentifier, 
                            styles: stylesCollect
                        });
                    }
                    stylesCollect.clear();
                }
            }
        },
    }
}