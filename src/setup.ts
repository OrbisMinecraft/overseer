import {setup} from "./database";

setup().then(v => {
    console.log('Successfully set up database.')
});
