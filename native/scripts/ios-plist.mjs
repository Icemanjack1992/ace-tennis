// iOS settings that App Review checks: why the app asks for location / photos / camera, encryption
import { readFileSync, writeFileSync } from 'node:fs';
const path = 'ios/App/App/Info.plist';
let p = readFileSync(path, 'utf8');
const add = (key, xml) => { if (!p.includes(`<key>${key}</key>`)) p = p.replace(/<\/dict>\s*<\/plist>\s*$/, `\t<key>${key}</key>\n\t${xml}\n</dict>\n</plist>\n`); };
add('NSLocationWhenInUseUsageDescription', '<string>Чтобы показать теннисные корты рядом с вами.</string>');
add('NSPhotoLibraryUsageDescription', '<string>Чтобы загрузить фото профиля или фото документа тренера.</string>');
add('NSCameraUsageDescription', '<string>Чтобы сфотографировать себя для профиля или документ тренера.</string>');
add('NSPhotoLibraryAddUsageDescription', '<string>Чтобы сохранить картинку с вашим результатом.</string>');
add('ITSAppUsesNonExemptEncryption', '<false/>');
writeFileSync(path, p);
console.log('Info.plist updated');
