
# BrainBox - An application from the [Open Neuroimaging Laboratory](http://openneu.ro/)

BrainBox is a web application that lets you annotate and segment 3D brain 
imaging data in real time, collaboratively. You can try it 
at http://brainbox.pasteur.fr.

BrainBox is a web application to share, visualise and annotate MRI brain
 data collaboratively. BrainBox will provide the means to create a 
 layer of collaborative annotation over all the available MRI data without 
 having to rely on a centralised data repository or the necessity of 
 having to install software.

You can try it at http://brainbox.pasteur.fr. Log in with your github 
account and enter the URL to an MRI file you want to visualise, annotate 
and edit. You can also click one of the examples.


# Developer instructions

If you want to work on BrainBox's code, you'll need a local installation:

## Using Docker to install and run BrainBox

1. git clone this repository or download it
2. cd to brainbox
3. get developer keys for your local brainbox url (http://localhost:3000 
by default)
4. paste the keys into the github-keys.json.example file, and drop the .example
5. also drop the .example from blacklist.json.example
6. mkdir 
6. make sure docker is installed
7. docker-compose up
8. Then open `http://localhost:3000` in your browser.

## Non docker developer install instructions

1. install mongo db; type `mongo` to get into the db; type `use brainbox` to create the `brainbox` database
2. clone the repo
3. create a directory `data` inside of `public`
4. get developer keys for your local brainbox url (http://localhost:3000 by default, but we made a virtual host to http://brainbox.dev)
5. paste the keys into the github-keys.json.example file, and drop the .example
6. `npm install`, then `npm start`


