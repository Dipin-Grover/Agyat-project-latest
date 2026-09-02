import fs from 'fs'
import path from 'path'

export const getAllFiles = (folderPath: string) => {
    let response : string[] =[];

    const allFilesandFolders=fs.readdirSync(folderPath); // sare path nikal lie inside the repo
    allFilesandFolders.forEach(file=>{
        const filePath=path.join(folderPath,file); // un paths ke aage aur explore kra to find paths inside them
        if(fs.statSync(filePath).isDirectory()){
            response = response.concat(getAllFiles(filePath)); // agr curr path dir hai to concat array response from finding paths in that dir
        }
        else response.push(filePath); // agr normal file hai to seedha push
    }) 
    return response;
}
 