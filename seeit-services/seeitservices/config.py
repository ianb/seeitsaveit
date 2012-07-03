import os
import initools.iniparser
from UserDict import DictMixin
import tempita


class MyParser(initools.iniparser.INIParser):

    def __init__(self):
        initools.iniparser.INIParser.__init__(self, True, ('=',))
        self.sections = []
        self.data = []

    def new_section(self, section):
        self.sections.append((section, self.filename, self.start_lineno))
        self.section = section

    def assignment(self, name, value):
        section = self.section or 'global'
        filename = self.filename
        pos = self.start_lineno
        if section not in self.sections:
            self.sections.append((section, filename, 0))
        self.data.append((section, name, value, filename, pos))


class Config(DictMixin):

    def __init__(self, vars=None):
        self._config = {}
        self._sections = []
        if vars is None:
            vars = {}
        self.vars = vars

    def load(self, filename):
        parser = MyParser()
        parser.load(filename, 'UTF-8')
        for section_name, filename, pos in parser.sections:
            if section_name not in self._sections:
                self._sections.append(section_name)
        for section, name, value, filename, pos in parser.data:
            self._config[(section, name)] = (value, filename, pos)

    def __setitem__(self, value):
        raise NotImplemented

    def __delitem__(self, value):
        raise NotImplemented

    def __getitem__(self, name):
        return Section(self, name)

    def __getattr__(self, name):
        if name.startswith('_'):
            raise AttributeError(name)
        return self[name]

    def keys(self):
        return list(self._sections)

    def by_prefix(self, prefix):
        sections = []
        for section_name in self._sections:
            if section_name.startswith(prefix):
                section = self[section_name]
                section.prefix_name = section_name[len(prefix):]
                sections.append(section)
        return sections


class Section(DictMixin):

    def __init__(self, config, name):
        self.config = config
        self.name = name

    def __repr__(self):
        return "<Section [%s]>" % self.name

    def __getitem__(self, name):
        value = self.config._config.get((self.name, name))
        if value is None:
            raise KeyError
        value, filename, pos = value
        if '{{' not in value:
            return value
        tmpl = tempita.Template(value, name='%s at %s' % (name, filename),
                                line_offset=pos - 1)
        return tmpl.substitute(
            section=self,
            globals=self.config['global'],
            config=self.config,
            __file__=filename,
            __section__=self.name,
            environ=os.environ,
            here=os.path.dirname(os.path.abspath(filename)),
            **self.config.vars)

    def __setitem__(self, value):
        raise NotImplemented

    def __delitem__(self, value):
        raise NotImplemented

    def __getattr__(self, name):
        if name.startswith('_'):
            raise AttributeError(name)
        return self.get(name)

    def keys(self):
        keys = []
        for (section, name) in self.config._config.iterkeys():
            if section == self.name:
                keys.append(name)
        return keys
