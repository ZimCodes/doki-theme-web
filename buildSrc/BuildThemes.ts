// @ts-ignore
import {DokiThemeDefinitions, ManifestTemplate, MasterDokiThemeDefinition, StringDictonary} from './types';

const path = require('path');

const repoDirectory = path.resolve(__dirname, '..');

const generatedThemesDirectory = path.resolve(repoDirectory, 'chromeThemes');

const fs = require('fs');

const masterThemeDefinitionDirectoryPath =
  path.resolve(repoDirectory, 'masterThemes');

const chromeTemplateDefinitionDirectoryPath = path.resolve(
  repoDirectory,
  "templates"
);


function walkDir(dir: string): Promise<string[]> {
  const values: Promise<string[]>[] = fs.readdirSync(dir)
    .map((file: string) => {
      const dirPath: string = path.join(dir, file);
      const isDirectory = fs.statSync(dirPath).isDirectory();
      if (isDirectory) {
        return walkDir(dirPath);
      } else {
        return Promise.resolve([path.join(dir, file)]);
      }
    });
  return Promise.all(values)
    .then((scannedDirectories) => scannedDirectories
      .reduce((accum, files) => accum.concat(files), []));
}

const LAF_TYPE = 'laf';
const SYNTAX_TYPE = 'syntax';
const NAMED_COLOR_TYPE = 'colorz';

function getTemplateType(templatePath: string) {
  if (templatePath.endsWith('laf.template.json')) {
    return LAF_TYPE;
  } else if (templatePath.endsWith('syntax.template.json')) {
    return SYNTAX_TYPE;
  } else if (templatePath.endsWith('colors.template.json')) {
    return NAMED_COLOR_TYPE;
  }
  return undefined;
}


function resolveTemplate<T, R>(
  childTemplate: T,
  templateNameToTemplate: StringDictonary<T>,
  attributeResolver: (t: T) => R,
  parentResolver: (t: T) => string,
): R {
  if (!parentResolver(childTemplate)) {
    return attributeResolver(childTemplate);
  } else {
    const parent = templateNameToTemplate[parentResolver(childTemplate)];
    const resolvedParent = resolveTemplate(
      parent,
      templateNameToTemplate,
      attributeResolver,
      parentResolver
    );
    return {
      ...resolvedParent,
      ...attributeResolver(childTemplate)
    };
  }
}


function resolveColor(
  color: string,
  namedColors: StringDictonary<string>
): string {
  const startingTemplateIndex = color.indexOf('&');
  if (startingTemplateIndex > -1) {
    const lastDelimeterIndex = color.lastIndexOf('&');
    const namedColor =
      color.substring(startingTemplateIndex + 1, lastDelimeterIndex);
    const namedColorValue = namedColors[namedColor];
    if (!namedColorValue) {
      throw new Error(`Named color: '${namedColor}' is not present!`);
    }

    // todo: check for cyclic references
    if (color === namedColorValue) {
      throw new Error(`Very Cheeky, you set ${namedColor} to resolve to itself 😒`);
    }

    const resolvedNamedColor = resolveColor(namedColorValue, namedColors);
    if (!resolvedNamedColor) {
      throw new Error(`Cannot find named color '${namedColor}'.`);
    }
    return resolvedNamedColor + color.substring(lastDelimeterIndex + 1) || '';
  }

  return color;
}

function applyNamedColors(
  objectWithNamedColors: StringDictonary<string>,
  namedColors: StringDictonary<string>,
): StringDictonary<string> {
  return Object.keys(objectWithNamedColors)
    .map(key => {
      const color = objectWithNamedColors[key];
      const resolvedColor = resolveColor(
        color,
        namedColors
      );
      return {
        key,
        value: resolvedColor
      };
    }).reduce((accum: StringDictonary<string>, kv) => {
      accum[kv.key] = kv.value;
      return accum;
    }, {});
}

function buildLAFColors(
  dokiThemeTemplateJson: MasterDokiThemeDefinition,
  dokiTemplateDefinitions: DokiThemeDefinitions
) {
  const lafTemplates = dokiTemplateDefinitions[NAMED_COLOR_TYPE];
  const lafTemplate =
    (dokiThemeTemplateJson.dark ?
      lafTemplates.dark : lafTemplates.light);

  const resolvedColorTemplate =
    resolveTemplate(
      lafTemplate, lafTemplates,
      template => template.colors,
      template => template.extends
    );

  const resolvedNameColors = resolveNamedColors(
    dokiTemplateDefinitions,
    dokiThemeTemplateJson
  );

  // do not really need to resolve, as there are no
  // &someName& colors, but what ever.
  const resolvedColors =
    applyNamedColors(resolvedColorTemplate, resolvedNameColors);
  return {
    ...resolvedColors,
    ...resolvedColorTemplate,
    ...resolvedNameColors,
  };
}

function resolveNamedColors(
  dokiTemplateDefinitions: DokiThemeDefinitions,
  dokiThemeTemplateJson: MasterDokiThemeDefinition
) {
  const colorTemplates = dokiTemplateDefinitions[NAMED_COLOR_TYPE];
  return resolveTemplate(
    dokiThemeTemplateJson,
    colorTemplates,
    template => template.colors,
    // @ts-ignore
    template => template.extends ||
      template.dark !== undefined && (dokiThemeTemplateJson.dark ?
        'dark' : 'light'));
}

function buildChromeTheme(
  dokiThemeDefinition: MasterDokiThemeDefinition,
  dokiTemplateDefinitions: DokiThemeDefinitions
) {
  if (dokiThemeDefinition.id === '546e8fb8-6082-4ef5-a5e3-44790686f02f') {
    console.log(JSON.stringify(dokiTemplateDefinitions, null, 2))
  }
  return {
    colors: buildLAFColors(
      dokiThemeDefinition,
      dokiTemplateDefinitions
    ),
  };
}

function createDokiTheme(
  dokiFileDefinitionPath: string,
  dokiThemeDefinition: MasterDokiThemeDefinition,
  dokiTemplateDefinitions: DokiThemeDefinitions,
  manifestTemplate: ManifestTemplate
) {
  try {
    return {
      path: dokiFileDefinitionPath,
      definition: dokiThemeDefinition,
      manifest: {},
      theme: buildChromeTheme(
        dokiThemeDefinition,
        dokiTemplateDefinitions
      )
    };
  } catch (e) {
    throw new Error(`Unable to build ${dokiThemeDefinition.name}'s theme for reasons ${e}`);
  }
}

const readJson = <T>(jsonPath: string): T =>
  JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

type TemplateTypes = StringDictonary<StringDictonary<string>>;

const isTemplate = (filePath: string): boolean =>
  !!getTemplateType(filePath);

const readTemplates = (templatePaths: string[]): TemplateTypes => {
  return templatePaths
    .filter(isTemplate)
    .map(templatePath => {
      return {
        type: getTemplateType(templatePath)!!,
        template: readJson<any>(templatePath)
      };
    })
    .reduce((accum: TemplateTypes, templateRepresentation) => {
      accum[templateRepresentation.type][templateRepresentation.template.name] =
        templateRepresentation.template;
      return accum;
    }, {
      [SYNTAX_TYPE]: {},
      [LAF_TYPE]: {},
      [NAMED_COLOR_TYPE]: {},
    });
};


function resolveStickerPath(
  themeDefinitonPath: string,
  sticker: string,
) {
  const stickerPath = path.resolve(
    path.resolve(themeDefinitonPath, '..'),
    sticker
  );
  return stickerPath.substr(masterThemeDefinitionDirectoryPath.length + '/definitions'.length);
}

const getStickers = (
  dokiDefinition: MasterDokiThemeDefinition,
  dokiTheme: any
) => {
  const secondary =
    dokiDefinition.stickers.secondary || dokiDefinition.stickers.normal;
  return {
    default: {
      path: resolveStickerPath(dokiTheme.path, dokiDefinition.stickers.default),
      name: dokiDefinition.stickers.default,
    },
    ...(secondary
      ? {
        secondary: {
          path: resolveStickerPath(dokiTheme.path, secondary),
          name: secondary,
        },
      }
      : {}),
  };
};


const omit = require('lodash/omit');

console.log('Preparing to generate themes.');
walkDir(path.resolve(masterThemeDefinitionDirectoryPath, 'templates'))
  .then(readTemplates)
  .then(dokiTemplateDefinitions => {
    return walkDir(path.resolve(masterThemeDefinitionDirectoryPath, 'definitions'))
      .then(files => files.filter(file => file.endsWith('master.definition.json')))
      .then(dokiFileDefinitionPaths => {
        return {
          dokiTemplateDefinitions,
          dokiFileDefinitionPaths
        };
      });
  })
  .then(templatesAndDefinitions => {
    const {
      dokiTemplateDefinitions,
      dokiFileDefinitionPaths
    } = templatesAndDefinitions;
    const manifestTemplate = readJson<ManifestTemplate>(path.resolve(chromeTemplateDefinitionDirectoryPath, 'manifest.template.json'))
    return dokiFileDefinitionPaths
      .map(dokiFileDefinitionPath => ({
        dokiFileDefinitionPath,
        dokiThemeDefinition: readJson<MasterDokiThemeDefinition>(dokiFileDefinitionPath),
        manifestTemplate,
      }))
      .filter(pathAndDefinition =>
        (pathAndDefinition.dokiThemeDefinition.product === 'ultimate' &&
          process.env.PRODUCT === 'ultimate') ||
        pathAndDefinition.dokiThemeDefinition.product !== 'ultimate'
      )
      .map(({
              dokiFileDefinitionPath,
              dokiThemeDefinition,
              manifestTemplate
            }) =>
        createDokiTheme(
          dokiFileDefinitionPath,
          dokiThemeDefinition,
          dokiTemplateDefinitions,
          manifestTemplate,
        )
      );
  }).then(dokiThemes => {

  // write things for extension
  dokiThemes.forEach(theme => {
    const themeDirectory = path.resolve(
      generatedThemesDirectory,
      `${theme.definition.name}'s Theme`
    );
    fs.mkdirSync(path.resolve(themeDirectory, 'images'), {recursive: true});

    // copy asset to directory
    getStickers(theme.definition, theme)

    //write manifest
    fs.writeFileSync(
      path.resolve(themeDirectory, 'manifest.json'),
      JSON.stringify(theme.manifest, null, 2)
    )
  });
})
  .then(() => {
    console.log('Theme Generation Complete!');
  });
