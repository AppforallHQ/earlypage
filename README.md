Setup and run puppet manifests
==============================

*   Login to the remote server and run

        sudo bash -c "echo 'root    ALL = NOPASSWD: ALL' >> /etc/sudoers"

    Then close the connection and run this locally

        ssh root@earlypage.FQDN "sudo apt-get install git puppet"

*   From your local git clone, run

        git remote add digital-ocean root@earlypage.FQDN:/app/earlypage

        git deploy setup -r digital-ocean
        git push digital-ocean master:master

*   To apply puppet manifests, run

        git push digital-ocean master:master -f
        ssh root@earlypage.FQDN "cd /app/earlypage/puppet; sudo puppet apply manifests/site.pp --modulepath=modules"

> **NOTE**
>
> You might need to ssh bitbucket for the first time to add it to known hosts.

> Just go to `/tmp` and run

>     git clone git@bitbucket.org:PROJECT/afbackenddeploy.git

> As root. Don't forget to copy `id_rsa.pub` of root as bitbucket deployment key.

Deployment
==========

*   Install `git-deploy` on your local machine.

        gem install git-deploy

*   Add a remote to your local git clone

        git remote add digital-ocean root@earlypage.FQDN:/app/earlypage

*   Initiate remote git remote and deploy hooks on the remote server

        git deploy setup -r digital-ocean

*   Push to remote

        git push digital-ocean master:master

*   Do the one time setup. `ssh` to remote server and run

        ssh root@earlypage.FQDN
        npm config set strict-ssl false
        cd /app/earlypage
        deploy/before_restart
        ./export_procfile
        sudo service earlypage start
